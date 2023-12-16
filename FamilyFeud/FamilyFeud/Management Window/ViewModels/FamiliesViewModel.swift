//
//  FamiliesViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/8/23.
//

import FeudKit
import Foundation
import SwiftUI

class FamiliesViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    public var families: [Family] {
        if let game = self.matchmanager.game {
            return game.getFamilies()
        } else {
            return []
        }
    }
    
    public var selectedFamilyId: Family.ID?
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    public func select() {
        if let game = self.matchmanager.game {
            if let selectedFamilyId {
                if let command = self.windowcontroller.chooseFamilyCommand {
                    _ = game.getState().executeAction(action: StatePlay.ACTION_EXECUTEPLAYACTION, data: [
                        command,
                        families.firstIndex { $0.id == selectedFamilyId } ?? -1
                    ])
                }
            }
        }
    }
}
