//
//  AddFamilyViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/8/23.
//

import FeudKit
import Foundation
import Observation

@Observable
class AddFamilyViewModel {
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    public var viewstateservice: ViewStateService
    
    public var familyName: String = ""
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.game = game
        self.viewstateservice = viewstateservice
        self.windowcontroller = windowcontroller
    }
    
    func addFamily() {
        let trimmedFamilyName = self.familyName.trimmingCharacters(in: NSCharacterSet.whitespacesAndNewlines)
        if (trimmedFamilyName.count > 0) {
            if (self.game.getState().executeAction(action: StateAddFamily.ACTION_ADDFAMILY, data: [trimmedFamilyName.uppercased()])) {
                self.familyName = ""
            }
        }
    }
    
    func removeFamily() {
        _ = self.game.getState().executeAction(action: StateAddFamily.ACTION_REMOVEFAMILY, data: [])
    }
}
