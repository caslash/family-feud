//
//  AddFamilyViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/8/23.
//

import FeudKit
import Foundation
import SwiftUI

class AddFamilyViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    public var familyName: String = ""
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    func addFamily() {
        if let game = self.matchmanager.game {
            let trimmedFamilyName = self.familyName.trimmingCharacters(in: NSCharacterSet.whitespacesAndNewlines)
            if (trimmedFamilyName.count > 0) {
                if (game.getState().executeAction(action: StateAddFamily.ACTION_ADDFAMILY, data: [trimmedFamilyName.uppercased()])) {
                    self.familyName = ""
                }
            }
        }
    }
    
    func removeFamily() {
        if let game = self.matchmanager.game {
            _ = game.getState().executeAction(action: StateAddFamily.ACTION_REMOVEFAMILY, data: [])
        }
    }
}
